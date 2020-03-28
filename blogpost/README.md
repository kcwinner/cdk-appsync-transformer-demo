# AppSync With The AWS Cloud Development Kit

## Deploying with automated schema definition language (SDL) transforms

### The Problem With AppSync

If you are familiar with AppSync you know how frustrating it can be to build out a full API, writing each individual piece of SDL for your models, your connections, filters, queries and mutations. Not only must you write the SDL you have to also write each resolver using velocity template language (VTL). A simple application can easily become a few hundred lines of SDL, VTL and Cloudformation. 

### [GraphQL Transform](https://docs.amplify.aws/cli/graphql-transformer/storage) Saves The Day

The Amplify CLI introduced some amazing packages to help transform your AppSync SDL into types, queries, mutations, subscriptions, tables and resolvers. Using [supported directives](https://aws-amplify.github.io/docs/cli-toolchain/graphql?sdk=js#directives) the cli transformation plugin will transform your SDL into deployable templates, streamlining the process of creating AppSync APIs. 

An example directive for the @model directive looks like this:
```
type Product
  @model {
    id: ID!
    name: String!
    description: String!
    price: String!
    active: Boolean!
    added: AWSDateTime!
}
```

<details>
    <summary>
        After transformation we get the following schema, as well as resolvers and cloudformation for a DynamoDB Table. Click to expand!
    </summary>

```
type Product {
  id: ID!
  name: String!
  description: String!
  price: String!
  active: Boolean!
  added: AWSDateTime!
}

type ModelProductConnection {
  items: [Product]
  nextToken: String
}

input CreateProductInput {
  id: ID
  name: String!
  description: String!
  price: String!
  active: Boolean!
  added: AWSDateTime!
}

input UpdateProductInput {
  id: ID!
  name: String
  description: String
  price: String
  active: Boolean
  added: AWSDateTime
}

input DeleteProductInput {
  id: ID
}

input ModelProductFilterInput {
  id: ModelIDFilterInput
  name: ModelStringFilterInput
  description: ModelStringFilterInput
  price: ModelStringFilterInput
  active: ModelBooleanFilterInput
  added: ModelStringFilterInput
  and: [ModelProductFilterInput]
  or: [ModelProductFilterInput]
  not: ModelProductFilterInput
}

type Query {
  getProduct(id: ID!): Product
  listProducts(filter: ModelProductFilterInput, limit: Int, nextToken: String): ModelProductConnection
}

type Mutation {
  createProduct(input: CreateProductInput!): Product
  updateProduct(input: UpdateProductInput!): Product
  deleteProduct(input: DeleteProductInput!): Product
}

type Subscription {
  onCreateProduct: Product @aws_subscribe(mutations: ["createProduct"])
  onUpdateProduct: Product @aws_subscribe(mutations: ["updateProduct"])
  onDeleteProduct: Product @aws_subscribe(mutations: ["deleteProduct"])
}
```

</details>

Using the GraphQL Transform plugin we turned 9 lines of SDL with a declaration into 62 lines. Extrapolate this to multiple types and we begin to see how automated transformations not only save us time but also give us a concise way of declaring some of the boilerplate around AppSync APIs.

### Pitfalls of using AWS Amplify CLI

As great as many of the features of the Amplify CLI are, I don't like to use it on a large scale project. I prefer to define my resources using the AWS Cloud Development Kit (CDK). Unfortunately for me the transformation plugin only exists in the Amplify CLI. I decided that in order to emulate this functionality I would take the same transformation packages used in the Amplify CLI and integrate them into my CDK project!

#### Recreating The Schema Transformer

In order to emulate the Amplify CLI transformer we have to have a schema transformer and import the existing transformers. Luckily the Amplify docs show us an implementation [here](https://aws-amplify.github.io/docs/cli-toolchain/plugins?sdk=js). Since we want to have all the same directives available to us we must implement the same packages and structure outlined above. This gives us our directive resolution, resolver creation, and template generation!

We end up with something like this:

```typescript
import { GraphQLTransform } from 'graphql-transformer-core';
import { DynamoDBModelTransformer } from 'graphql-dynamodb-transformer';
import { ModelConnectionTransformer } from 'graphql-connection-transformer';
import { KeyTransformer } from 'graphql-key-transformer';
import { FunctionTransformer } from 'graphql-function-transformer';
import { VersionedModelTransformer } from 'graphql-versioned-transformer';
import { ModelAuthTransformer, ModelAuthTransformerConfig } from 'graphql-auth-transformer'
const { AppSyncTransformer } = require('graphql-appsync-transformer')
import { normalize } from 'path';
import * as fs from "fs";

const outputPath = './appsync'

export class SchemaTransformer {
    transform() {
        // These config values do not even matter... So set it up for both
        const authTransformerConfig: ModelAuthTransformerConfig = {
            authConfig: {
                defaultAuthentication: {
                    authenticationType: 'API_KEY',
                    apiKeyConfig: {
                        description: 'Testing',
                        apiKeyExpirationDays: 100
                    }
                },
                additionalAuthenticationProviders: [
                    {
                        authenticationType: 'AMAZON_COGNITO_USER_POOLS',
                        userPoolConfig: {
                            userPoolId: '12345xyz'
                        }
                    }
                ]
            }
        }

        // Note: This is not exact as we are omitting the @searchable transformer.
        const transformer = new GraphQLTransform({
            transformers: [
                new AppSyncTransformer(outputPath),
                new DynamoDBModelTransformer(),
                new VersionedModelTransformer(),
                new FunctionTransformer(),
                new KeyTransformer(),
                new ModelAuthTransformer(authTransformerConfig),
                new ModelConnectionTransformer(),
            ]
        })

        const schema_path = './schema.graphql'
        const schema = fs.readFileSync(schema_path)

        return transformer.transform(schema.toString());
    }
}
```

#### Writing Our Own Transformer

After implementing the schema transformer exactly the same I realized it doesn't fit our CDK implementation perfectly. For example, instead of json cloudformation output of our dynamo tables we want iterable resources that can be created via the CDK. In comes our own [transformer](https://github.com/kcwinner/cdk-appsync-transformer-demo/blob/master/lib/transformer.ts)! 

In this custom transformer we do two things - look for the @nullable directive and grab the transformer context after completion. 

##### @nullable Directive

When creating a custom key using the `@key` direction on a model the associated resolver does not allow for using `$util.autoId()` to generate a unique identifier and creation time. I've implemented this new directive using [graphql-auto-transformer](https://github.com/hirochachacha/graphql-auto-transformer) as a guide. This outputs a modified resolver for the field with our custom directive.

##### Post Transformation

After schema transformation is complete our custom transformer grabs the context, searches for `AWS::DynamoDB::Table` resources, and builds a table object for us to create a table from later. Later, we can loop over this output and create our tables and resolvers like so:

```typescript
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
```

#### Using The Schema Transformer

In order to run our transformer before the CDK's template generation we must import our transformer, run transformer, and pass the data to our stack!

```typescript
#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { AppStack } from '../lib/app-stack';
import { SchemaTransformer } from '../lib/schema-transformer';

const transformer = new SchemaTransformer();
const outputs = transformer.transform();
const resolvers = transformer.getResolvers();

const STAGE = process.env.STAGE || 'demo'

const app = new cdk.App({ 
    context: { STAGE: STAGE }
})

new AppStack(app, 'AppStack', outputs, resolvers);
```

### Where Do We Go From Here?



### References

* [Amplify Docs](https://aws-amplify.github.io/docs/)
* 