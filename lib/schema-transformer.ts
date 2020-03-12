import { GraphQLTransform } from 'graphql-transformer-core';
import { DynamoDBModelTransformer } from 'graphql-dynamodb-transformer';
import { ModelConnectionTransformer } from 'graphql-connection-transformer';
import { KeyTransformer } from 'graphql-key-transformer';
import { FunctionTransformer } from 'graphql-function-transformer';
import { VersionedModelTransformer } from 'graphql-versioned-transformer';

import { 
    ModelAuthTransformer, 
    ModelAuthTransformerConfig,
} from 'graphql-auth-transformer'

const { AppSyncTransformer } = require('graphql-appsync-transformer')
const { MyTransformer } = require('./transformer');

import { normalize } from 'path';
import * as fs from "fs";

const outputPath = './appsync'

export class SchemaTransformer {
    outputs: any
    resolvers: any

    constructor() {
        this.resolvers = {}
    }

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
                new MyTransformer()
            ]
        })

        const schema_path = './schema.graphql'
        const schema = fs.readFileSync(schema_path)

        const cfdoc = transformer.transform(schema.toString());
        this.outputs = cfdoc.rootStack.Outputs;

        return this.outputs;
    }

    getResolvers() {
        const resolversDirPath = normalize('./appsync/resolvers')
        if (fs.existsSync(resolversDirPath)) {
            const files = fs.readdirSync(resolversDirPath)
            files.forEach(file => {
                // Example: Mutation.createChannel.response
                let args = file.split('.')
                let name: string = args[1]
                let templateType = args[2] // request or response
                let filepath = normalize(`${resolversDirPath}/${file}`)

                if (!this.resolvers[name]) {
                    this.resolvers[name] = {
                        typeName: args[0],
                        fieldName: name,
                    }
                }
                
                if (templateType === 'request') {
                    this.resolvers[name]['requestMappingTemplate'] = filepath
                } else if (templateType === 'response') {
                    this.resolvers[name]['responseMappingTemplate'] = filepath
                }
            })
        }

        return this.resolvers;
    }
}