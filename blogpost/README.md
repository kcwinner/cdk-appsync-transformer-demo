# AppSync With The AWS Cloud Development Kit

## Deploying with automated schema definition language (SDL) transforms

### The Problem With AppSync

If you are familiar with AppSync you know how frustrating it can be to build out a full API, writing each individual piece of SDL for your models, your connections, filters, queries and mutations. Not only must you write the SDL you have to also write each resolver using velocity template language (VTL). A simple application can easily become a few hundred lines of SDL, VTL and Cloudformation. 

### [GraphQL Transform](https://docs.amplify.aws/cli/graphql-transformer/storage) Saves The Day

The Amplify CLI introduced some amazing packages to help transform your AppSync SDL into types, queries, mutations, subscriptions, tables and resolvers. Using supported directives the cli transformation plugin will transform your SDL into deployable templates, streamlining the process of creating AppSync APIs and 

An example directive for a model looks like this:
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

After transformation we get the below SDL, as well as resolvers and cloudformation for a DynamoDB Table.

```collapsible
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

Using the GraphQL Transform plugin we turned 9 lines of SDL with a declaration into 62 lines. Extrapolate this to multiple types and we begin to see how automated transformations not only save us time but also give us a concise way of declaring some of the boilerplate around AppSync APIs.

[Available directives](https://aws-amplify.github.io/docs/cli-toolchain/graphql?sdk=js#directives) for use can be found here.

### Pitfalls of using AWS Amplify CLI

As great as many of the features of the Amplify CLI are, I don't like to use it on a large scale project. I prefer to define my resources using the AWS Cloud Development Kit. Unfortunately for me the transformation plugin only exists in the Amplify CLI. I decided that in order to emulate this functionality I would take the same transformation packages used in the Amplify CLI and integrate them into my CDK project! 


```app.ts
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AppStack } from '../lib/app-stack';

import { SchemaTransformer } from '../lib/schema-transformer';

const transformer = new SchemaTransformer();
let outputs = transformer.transform();
let resolvers = transformer.getResolvers();

const STAGE = process.env.STAGE || 'demo'

const app = new cdk.App(
{ 
    context: { 
        STAGE: STAGE
    }
})

new AppStack(app, 'AppStack', outputs, resolvers);
```

### Where Do We Go From Here?

