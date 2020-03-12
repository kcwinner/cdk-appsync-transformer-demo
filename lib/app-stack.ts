import * as cdk from '@aws-cdk/core';

import { GraphQLApi, FieldLogLevel, MappingTemplate, CfnDataSource, CfnResolver } from '@aws-cdk/aws-appsync';
import { Table, AttributeType, BillingMode } from '@aws-cdk/aws-dynamodb';

export class AppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, outputs: any, resolvers: any, props?: cdk.StackProps) {
    super(scope, id, props);

    const STAGE = this.node.tryGetContext('STAGE')

    const api = new GraphQLApi(
      this,
      'demo-gql-api', {
      name: `demo-api-${STAGE}`,
      authorizationConfig: {
        defaultAuthorization: {
          apiKeyDesc: 'Dev Testing Only',
            expire: 365
        },
      },
      logConfig: {
        fieldLogLevel: FieldLogLevel.ERROR,
      },
      schemaDefinitionFile: './appsync/schema.graphql'
    })

    let tableData = outputs.CDK_TABLES
    this.createTablesAndResolvers(api, tableData, resolvers)
  }

  createTablesAndResolvers(api: GraphQLApi, tableData: any, resolvers: any) {
    Object.keys(tableData).forEach((tableKey: any) => {
      let table = this.createTable(tableData[tableKey]);

      const dataSource = api.addDynamoDbDataSource(tableKey, `Data source for ${tableKey}`, table);

      Object.keys(resolvers).forEach((resolverKey: any) => {
        let resolverTableName = this.getTableNameFromFieldName(resolverKey)
        if (tableKey === resolverTableName) {
          let resolver = resolvers[resolverKey]

          dataSource.createResolver({
            typeName: resolver.typeName,
            fieldName: resolver.fieldName,
            requestMappingTemplate: MappingTemplate.fromFile(resolver.requestMappingTemplate),
            responseMappingTemplate: MappingTemplate.fromFile(resolver.responseMappingTemplate),
          })
        }
      })
    });
  }

  createTable(table: any) {
    let tableProps: any = {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: table.PartitionKey.name,
        type: this.convertAttributeType(table.PartitionKey.type)
      }
    };

    if (table.SortKey && table.SortKey.name) {
      tableProps.sortKey = {
        name: table.SortKey.name,
        type: this.convertAttributeType(table.SortKey.type)
      };
    };

    return new Table(this, table.TableName, tableProps);
  }

  convertAttributeType(type: any) {
    if (type === 'S') {
      return AttributeType.STRING
    } else if (type === 'N') {
      return AttributeType.NUMBER
    } else if (type === 'B') {
      return AttributeType.BINARY
    }

    return AttributeType.STRING
  }

  getTableNameFromFieldName(fieldName: string) {
    let tableName = ''
    let plural = false
    let replace = ''

    if (fieldName.indexOf('list') > -1) {
      replace = 'list'
      plural = true
    } else if (fieldName.indexOf('get') > -1) {
      replace = 'get'
    } else if (fieldName.indexOf('delete') > -1) {
      replace = 'delete'
    } else if (fieldName.indexOf('create') > -1) {
      replace = 'create'
    } else if (fieldName.indexOf('update') > -1) {
      replace = 'update'
    }

    tableName = fieldName.replace(replace, '')

    if (plural) {
      tableName = tableName.slice(0, -1)
    }

    return tableName + 'Table'
  }
}
