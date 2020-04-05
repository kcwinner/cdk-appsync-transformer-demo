import * as cdk from '@aws-cdk/core';
import { PolicyStatement, Effect } from '@aws-cdk/aws-iam'
import { GraphQLApi, FieldLogLevel, MappingTemplate } from '@aws-cdk/aws-appsync';
import { Table, AttributeType, BillingMode, ProjectionType } from '@aws-cdk/aws-dynamodb';

export class AppStack extends cdk.Stack {
  private isSyncEnabled: boolean
  private syncTable: Table

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
          expire: 100
        },
      },
      logConfig: {
        fieldLogLevel: FieldLogLevel.ERROR,
      },
      schemaDefinitionFile: './appsync/schema.graphql'
    })

    let tableData = outputs.CDK_TABLES

    // Check to see if sync is enabled
    if (tableData['DataStore']) {
      this.isSyncEnabled = true
      this.syncTable = this.createSyncTable(tableData['DataStore']);
      delete tableData['DataStore'] // We don't want to create this again below so remove it from the tableData map
    }

    this.createTablesAndResolvers(api, tableData, resolvers)
  }

  createTablesAndResolvers(api: GraphQLApi, tableData: any, resolvers: any) {
    Object.keys(tableData).forEach((tableKey: any) => {
      const table = this.createTable(tableData[tableKey]);
      const dataSource = api.addDynamoDbDataSource(tableKey, `Data source for ${tableKey}`, table);

      // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-appsync-datasource-deltasyncconfig.html

      if (this.isSyncEnabled) {
        //@ts-ignore - ds is the base CfnDataSource and the db config needs to be versioned - see CfnDataSource
        dataSource.ds.dynamoDbConfig.versioned = true

        //@ts-ignore - ds is the base CfnDataSource - see CfnDataSource
        dataSource.ds.dynamoDbConfig.deltaSyncConfig = {
          baseTableTtl: '43200', // Got this value from amplify - 30 days in minutes
          deltaSyncTableName: this.syncTable.tableName,
          deltaSyncTableTtl: '30' // Got this value from amplify - 30 minutes
        }

        // Need to add permission for our datasource service role to access the sync table
        dataSource.grantPrincipal.addToPolicy(new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'dynamodb:*'
          ],
          resources: [
            this.syncTable.tableArn
          ]
        }))
      }

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

  createTable(tableData: any) {
    let tableProps: any = {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: tableData.PartitionKey.name,
        type: this.convertAttributeType(tableData.PartitionKey.type)
      }
    };

    if (tableData.SortKey && tableData.SortKey.name) {
      tableProps.sortKey = {
        name: tableData.SortKey.name,
        type: this.convertAttributeType(tableData.SortKey.type)
      };
    };

    if (tableData.TTL && tableData.TTL.Enabled) {
      tableProps.timeToLiveAttribute = tableData.TTL.AttributeName;
    }

    let table = new Table(this, tableData.TableName, tableProps);

    if (tableData.GlobalSecondaryIndexes && tableData.GlobalSecondaryIndexes.length > 0) {
      tableData.GlobalSecondaryIndexes.forEach((gsi: any) => {
        table.addGlobalSecondaryIndex({
          indexName: gsi.IndexName,
          partitionKey: {
            name: gsi.PartitionKey.name,
            type: this.convertAttributeType(gsi.PartitionKey.type)
          },
          projectionType: this.convertProjectionType(gsi.Projection.ProjectionType)
        })
      })
    }

    return table;
  }

  // https://docs.aws.amazon.com/appsync/latest/devguide/conflict-detection-and-sync.html
  createSyncTable(tableData: any) {
    return new Table(this, 'sync-table', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: tableData.PartitionKey.name,
        type: this.convertAttributeType(tableData.PartitionKey.type)
      },
      sortKey: {
        name: tableData.SortKey.name,
        type: this.convertAttributeType(tableData.SortKey.type)
      },
      timeToLiveAttribute: tableData.TTL?.AttributeName || '_ttl'
    })
  }

  convertAttributeType(type: string) {
    switch (type) {
      case 'S':
        return AttributeType.STRING
      case 'N':
        return AttributeType.NUMBER
      case 'B':
        return AttributeType.BINARY
      default:
        return AttributeType.STRING
    }
  }

  convertProjectionType(type: string) {
    switch (type) {
      case 'ALL':
        return ProjectionType.ALL
      case 'INCLUDE':
        return ProjectionType.INCLUDE
      case 'KEYS_ONLY':
        return ProjectionType.KEYS_ONLY
      default:
        return ProjectionType.ALL
    }
  }

  getTableNameFromFieldName(fieldName: string) {
    let tableName = ''
    let plural = false
    let replace = ''

    if (fieldName.indexOf('list') > -1) {
      replace = 'list'
      plural = true
    } else if (fieldName.indexOf('sync') > -1) {
      replace = 'sync'
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