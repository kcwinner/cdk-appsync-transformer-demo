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