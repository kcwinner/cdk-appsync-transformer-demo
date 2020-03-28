import { 
    Transformer, 
    TransformerContext, 
    InvalidDirectiveError, 
    TransformerContractError,
    getDirectiveArguments
} from "graphql-transformer-core";

import {
    ObjectTypeDefinitionNode,
    DirectiveNode,
    InterfaceTypeDefinitionNode,
    FieldDefinitionNode,
    Kind,
    //@ts-ignore
} from 'graphql'

import { 
    ResourceConstants,
    ModelResourceIDs, 
    ResolverResourceIDs,
    isNonNullType, 
    makeInputValueDefinition, 
    unwrapNonNull,
    toCamelCase,
    graphqlName,
    toUpper
} from 'graphql-transformer-common'

import {
    set,
    compoundExpression,
    printBlock,
    print,
    ifElse,
    qref,
    raw,
    ref,
    obj,
    str,
    iff,
    and,
    DynamoDBMappingTemplate
} from 'graphql-mapping-template'

const cloudform_types_1 = require('cloudform-types')

import Resource from "cloudform/types/resource";
import { normalize } from "path";
import fs = require('fs');

export class MyTransformer extends Transformer {
    outputPath: string
    tables: any

    constructor(outputPath?: string) {
        super(
            'MyTransformer',
            'directive @nullable on FIELD_DEFINITION' 
        )
        this.tables = {}

        if (outputPath) {
            this.outputPath = normalize(outputPath)
        }
    }

    public after = (ctx: TransformerContext): void => {
        if (!this.outputPath) {
            this.printWithoutFilePath(ctx);
        } else {
            this.printWithFilePath(ctx);
            this.tables.forEach((table: any) => {
                this.writeTableToFile(table)
            })
        }

        ctx.setOutput('CDK_TABLES', this.tables)
    }

    private printWithoutFilePath(ctx: TransformerContext): void {
        // @ts-ignore
        const templateResources: { [key: string]: Resource } = ctx.template.Resources

        for (const resourceName of Object.keys(templateResources)) {
            const resource: Resource = templateResources[resourceName]
            if (resource.Type === 'AWS::DynamoDB::Table') {
                this.buildTablesFromResource(resourceName, ctx)
            }
        }
    }

    private printWithFilePath(ctx: TransformerContext): void {

        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath);
        }

        const tableFilePath = normalize(this.outputPath + '/tables')
        if (fs.existsSync(tableFilePath)) {
            const files = fs.readdirSync(tableFilePath)
            files.forEach(file => fs.unlinkSync(tableFilePath + '/' + file))
            fs.rmdirSync(tableFilePath)
        }

        // @ts-ignore
        const templateResources: { [key: string]: Resource } = ctx.template.Resources

        for (const resourceName of Object.keys(templateResources)) {
            const resource: Resource = templateResources[resourceName]
            if (resource.Type === 'AWS::DynamoDB::Table') {
                this.buildTablesFromResource(resourceName, ctx)
            }
        }
    }

    private buildTablesFromResource(resourceName: string, ctx: TransformerContext): void {
        // @ts-ignore
        const tableResource = ctx.template.Resources[resourceName]

        let partitionKey: any = {}
        let sortKey: any = {}

        const attributeDefinitions = tableResource.Properties?.AttributeDefinitions
        const keySchema = tableResource.Properties?.KeySchema

        if (keySchema.length == 1) {
            partitionKey = {
                name: attributeDefinitions[0].AttributeName,
                type: attributeDefinitions[0].AttributeType
            }
        } else {
            keySchema.forEach((key: any) => {
                let keyType = key.KeyType
                let attributeName = key.AttributeName

                let attribute = attributeDefinitions.find((attribute: any) => {
                    return attribute.AttributeName === attributeName
                })

                if (keyType === 'HASH') {
                    partitionKey = {
                        name: attribute.AttributeName,
                        type: attribute.AttributeType
                    }
                } else if (keyType === 'RANGE') {
                    sortKey = {
                        name: attribute.AttributeName,
                        type: attribute.AttributeType
                    }
                }
            })
        }

        this.tables[resourceName] = {
            TableName: resourceName,
            KeySchema: keySchema,
            AttributeDefinitions: attributeDefinitions,
            PartitionKey: partitionKey,
            SortKey: sortKey
        }
    }

    private writeTableToFile(table: any): void {
        const tableFilePath = normalize(this.outputPath + '/tables')
        if (!fs.existsSync(tableFilePath)) {
            fs.mkdirSync(tableFilePath);
        }

        fs.writeFileSync(`${tableFilePath}/${table.TableName}.json`, JSON.stringify(table))
    }

    public field = (
        parent: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode,
        definition: FieldDefinitionNode,
        directive: DirectiveNode,
        ctx: TransformerContext
    ) => {
        if (parent.kind === Kind.INTERFACE_TYPE_DEFINITION) {
            throw new InvalidDirectiveError(
                `The @nullable directive cannot be placed on an interface's field. See ${parent.name.value}${definition.name.value}`
            )
        }

        //@ts-ignore
        const modelDirective = parent.directives?.find((dir) => dir.name.value === 'key')
        if (!modelDirective) {
            throw new InvalidDirectiveError('Types annotated with @nullable must also be annotated with @key.')
        }

        if (!isNonNullType(definition.type)) {
            throw new TransformerContractError(`@nullable directive can only be used on non-nullable type fields`)
        }

        this.updateCreateInput(ctx, parent.name.value, definition)

        const createResolver = ctx.getResource(ResolverResourceIDs.DynamoDBCreateResolverResourceID(parent.name.value));
        if (createResolver !== undefined) {
            let directive = this.getParentKeyDirective(parent)

            //@ts-ignore
            // console.log(DynamoDBMappingTemplate.putItem(directive))

            let newResolver = this.makeCreateResolver({
                type: parent.name.value
            });

            //@ts-ignore
            createResolver.Properties.RequestMappingTemplate = this.joinSnippets([
                this.setKeySnippet(directive, true),
                this.ensureCompositeKeySnippet(directive),
                //@ts-ignore
                // createResolver.Properties.RequestMappingTemplate,
                newResolver.Properties.RequestMappingTemplate
            ]);
        }
    }

    private updateCreateInput(
        ctx: TransformerContext,
        typeName: string,
        autoField: FieldDefinitionNode
    ) {
        this.updateInput(ctx, ModelResourceIDs.ModelCreateInputObjectName(typeName), autoField)
    }

    private updateInput(
        ctx: TransformerContext,
        inputName: string,
        autoField: FieldDefinitionNode
    ) {
        const input = ctx.getType(inputName)
        if (input && input.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
            //@ts-ignore
            if (input.fields) {
                // make autoField nullable
                //@ts-ignore
                ctx.putType({
                    ...input,
                    //@ts-ignore
                    fields: input.fields.map((f) => {
                        if (f.name.value === autoField.name.value) {
                            return makeInputValueDefinition(autoField.name.value, unwrapNonNull(autoField.type))
                        }
                        return f
                    }),
                })
            }
        }
    }

    private setKeySnippet(directive: DirectiveNode, isMutation: boolean = false) {
        const directiveArgs = getDirectiveArguments(directive);

        //@ts-ignore
        const cmds = [set(ref(ResourceConstants.SNIPPETS.ModelObjectKey), this.modelObjectKey(directiveArgs, isMutation))];
        return printBlock(`Set the primary @key`)(compoundExpression(cmds));
    };

    private ensureCompositeKeySnippet(directive: DirectiveNode) {
        const args = getDirectiveArguments(directive);
        const argsPrefix = 'ctx.args.input';
        if (args.fields.length > 2) {
            const rangeKeyFields = args.fields.slice(1);
            const condensedSortKey = this.condenseRangeKey(rangeKeyFields);
            const dynamoDBFriendlySortKeyName = toCamelCase(rangeKeyFields.map((f: any) => graphqlName(f)));
            const condensedSortKeyValue = this.condenseRangeKey(rangeKeyFields.map((keyField: any) => `\${${argsPrefix}.${keyField}}`));
            return print(compoundExpression([
                //@ts-ignore
                ifElse(raw(`$util.isNull($${ResourceConstants.SNIPPETS.DynamoDBNameOverrideMap})`), set(ref(ResourceConstants.SNIPPETS.DynamoDBNameOverrideMap), obj({
                    [condensedSortKey]: str(dynamoDBFriendlySortKeyName),
                })),
                //@ts-ignore
                qref(`$${ResourceConstants.SNIPPETS.DynamoDBNameOverrideMap}.put("${condensedSortKey}", "${dynamoDBFriendlySortKeyName}")`)),
                qref(`$ctx.args.input.put("${condensedSortKey}","${condensedSortKeyValue}")`),
            ]));
        }
        return '';
    }

    private condenseRangeKey(fields: any) {
        //@ts-ignore
        return fields.join(ModelResourceIDs.ModelCompositeKeySeparator());
    }

    private modelObjectKey(args: any, isMutation: boolean) {
        const argsPrefix = isMutation ? 'ctx.args.input' : 'ctx.args';
        if (args.fields.length > 2) {
            const rangeKeyFields = args.fields.slice(1);
            const condensedSortKey = this.condenseRangeKey(rangeKeyFields);
            //@ts-ignore
            const condensedSortKeyValue = this.condenseRangeKey(rangeKeyFields.map(keyField => `\${${argsPrefix}.${keyField}}`));
            return obj({
                [args.fields[0]]: ref(`util.dynamodb.toDynamoDB($${argsPrefix}.${args.fields[0]})`),
                [condensedSortKey]: ref(`util.dynamodb.toDynamoDB("${condensedSortKeyValue}")`),
            });
        }
        else if (args.fields.length === 2) {
            return obj({
                [args.fields[0]]: ref(`util.dynamodb.toDynamoDB($util.defaultIfNullOrBlank($${argsPrefix}.${args.fields[0]}, $util.autoId()))`),
                [args.fields[1]]: ref(`util.dynamodb.toDynamoDB($${argsPrefix}.${args.fields[1]})`),
            });
        }
        else if (args.fields.length === 1) {
            return obj({
                [args.fields[0]]: ref(`util.dynamodb.toDynamoDB($${argsPrefix}.${args.fields[0]})`),
            });
        }
        throw new InvalidDirectiveError('@key directives must include at least one field.');
    }

    private joinSnippets(lines: any) {
        return lines.join('\n');
    }

    private getParentKeyDirective(parent: any) {
        let directive = parent.directives.find((directive: any) => {
            return directive.name.value === 'key'
        })
        return directive
    }

    //@ts-ignore
    private makeCreateResolver({ type, mutationTypeName = 'Mutation' }) {
        const fieldName = graphqlName('create' + toUpper(type));
        return new cloudform_types_1.AppSync.Resolver({
            ApiId: cloudform_types_1.Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
            DataSourceName: cloudform_types_1.Fn.GetAtt(ModelResourceIDs.ModelTableDataSourceID(type), 'Name'),
            FieldName: fieldName,
            TypeName: mutationTypeName,
            RequestMappingTemplate: printBlock('Prepare DynamoDB PutItem Request')(compoundExpression([
                qref('$context.args.input.put("createdAt", $util.defaultIfNull($ctx.args.input.createdAt, $util.time.nowISO8601()))'),
                qref('$context.args.input.put("updatedAt", $util.defaultIfNull($ctx.args.input.updatedAt, $util.time.nowISO8601()))'),
                qref(`$context.args.input.put("__typename", "${type}")`),
                set(ref('condition'), obj({
                    expression: str('attribute_not_exists(#id)'),
                    expressionNames: obj({
                        '#id': str('id'),
                    }),
                })),
                iff(ref('context.args.condition'), compoundExpression([
                    set(ref('condition.expressionValues'), obj({})),
                    set(ref('conditionFilterExpressions'), raw('$util.parseJson($util.transform.toDynamoDBConditionExpression($context.args.condition))')),
                    qref(`$condition.put("expression", "($condition.expression) AND $conditionFilterExpressions.expression")`),
                    qref(`$condition.expressionNames.putAll($conditionFilterExpressions.expressionNames)`),
                    qref(`$condition.expressionValues.putAll($conditionFilterExpressions.expressionValues)`),
                ])),
                iff(and([ref('condition.expressionValues'), raw('$condition.expressionValues.size() == 0')]), set(ref('condition'), obj({
                    expression: ref('condition.expression'),
                    expressionNames: ref('condition.expressionNames'),
                }))),
                DynamoDBMappingTemplate.putItem({
                    //@ts-ignore
                    key: ifElse(ref(ResourceConstants.SNIPPETS.ModelObjectKey), raw(`$util.toJson(\$${ResourceConstants.SNIPPETS.ModelObjectKey})`), obj({
                        id: raw(`$util.dynamodb.toDynamoDBJson($util.defaultIfNullOrBlank($ctx.args.input.id, $util.autoId()))`),
                    }), true),
                    attributeValues: ref('util.dynamodb.toMapValuesJson($context.args.input)'),
                    condition: ref('util.toJson($condition)'),
                    //@ts-ignore
                }, '2017-02-28'),
            ]))
        });
    }
}