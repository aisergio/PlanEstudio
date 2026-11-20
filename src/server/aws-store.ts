import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import type { Item, Store } from './store.ts';

export class AwsStore implements Store {
  private db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });

  constructor(private readonly table: string) {}

  async get(key: string) {
    const result = await this.db.send(new GetCommand({ TableName: this.table, Key: { owner: 'owner', key }, ConsistentRead: true }));
    return result.Item as Item | undefined;
  }

  async list(prefix: string) {
    const items: Item[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await this.db.send(new QueryCommand({
        TableName: this.table, ConsistentRead: true,
        KeyConditionExpression: '#owner = :owner AND begins_with(#key, :prefix)',
        ExpressionAttributeNames: { '#owner': 'owner', '#key': 'key' },
        ExpressionAttributeValues: { ':owner': 'owner', ':prefix': prefix },
        ExclusiveStartKey: lastKey
      }));
      items.push(...(result.Items ?? []) as Item[]);
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }

  async put(key: string, value: unknown, expected?: string | null) {
    try {
      await this.db.send(new PutCommand({
        TableName: this.table,
        Item: { owner: 'owner', key, revision: randomUUID(), value },
        ConditionExpression: expected === null ? 'attribute_not_exists(#key)' : expected === undefined ? undefined : 'revision = :expected',
        ExpressionAttributeNames: expected === null ? { '#key': 'key' } : undefined,
        ExpressionAttributeValues: typeof expected === 'string' ? { ':expected': expected } : undefined
      }));
      return true;
    } catch (error) {
      if ((error as Error).name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }

  async remove(key: string, expected?: string) {
    try {
      await this.db.send(new DeleteCommand({
        TableName: this.table, Key: { owner: 'owner', key },
        ConditionExpression: expected ? 'revision = :expected' : undefined,
        ExpressionAttributeValues: expected ? { ':expected': expected } : undefined
      }));
      return true;
    } catch (error) {
      if ((error as Error).name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }
}
