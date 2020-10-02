import * as fs from 'fs';
import * as path from 'path';
import { GraphQLJSON } from 'graphql-type-json';
import * as GraphQLUUID from 'graphql-type-uuid';
import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from 'graphql-tools';
import { register } from 'ts-node';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { Export } from './types';

const env = process.env.NODE_ENV || 'development';
const port = process.env.PORT || 0;

// Load ts-node
register({
    transpileOnly: true
});

const args = process.argv.slice(2);
const schemasToLoad: string[] = [];
const schemas = (args.length === 0 ? ['example'] : args).map(directory => {
    try {
        const fullPath = path.resolve(__dirname, '..', directory);
        return fs.readdirSync(fullPath).map(fileName => {
            try {
                const schemaPath = path.join(fullPath, fileName);
                schemasToLoad.push(schemaPath);
                return require(schemaPath).default as Export;
            } catch {}
        });
    } catch {}
}).flatMap(_ => _).filter(Boolean);

const typeDefs = [
    `
        scalar JSON
        scalar UUID
    `,
    // If no schemas return demo query
    // Otherwise return schemas
    ...(schemas.length === 0 ? [`
        type Error {
            message: String
            files: [String]
        }

        type Query {
            hello: String!
            error: Error
        }
    `] : schemas.map(_ => _.schema)),
];

const resolvers = [
    {
        JSON: GraphQLJSON,
        UUID: GraphQLUUID,
    },
    // If no schemas return demo query
    // Otherwise return schemas
    ...(schemas.length === 0 ? [{
        Query: {
            hello: () => 'world!',
            error: () => {
                return {
                    message: `Couldn't load any schema files.`,
                    files: schemasToLoad
                };
            }
        }
    }] : schemas.map(({ schema: _, ...resolvers }) => ({
        ...resolvers
    })))
];

// Build schema
const schema = makeExecutableSchema({
    typeDefs: mergeTypeDefs(typeDefs),
    resolvers: mergeResolvers(resolvers)
});

export const server = new ApolloServer({
    playground: Boolean(process.env.PLAYGROUND),
    introspection: Boolean(process.env.INTROSPECTION),
    debug: Boolean(process.env.DEBUG),
    schema
});

// Start server
const main = async () => {
    const url = await server.listen(port).then(_ => _.url);
    console.debug(`Graphql ready at ${url}`)
};

main().catch(error => console.error(env === 'production' ? error.message : error));