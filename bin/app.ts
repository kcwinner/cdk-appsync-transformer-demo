#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { AppStack } from '../lib/app-stack';

import { SchemaTransformer } from '../transform/schema-transformer';

const transformer = new SchemaTransformer();
const outputs = transformer.transform();
const resolvers = transformer.getResolvers();

// AWS Guidance below. However, I prefer to use the cdk context for environment values instead of multiple stacks
// https://docs.aws.amazon.com/cdk/latest/guide/environments.html
// https://github.com/aws/aws-cdk/issues/4846#issuecomment-552797597
const STAGE = process.env.STAGE || 'demo'

const app = new cdk.App(
{ 
    context: { 
        STAGE: STAGE
    }
})

new AppStack(app, 'AppStack', outputs, resolvers);