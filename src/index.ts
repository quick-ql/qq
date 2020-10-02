import * as fs from 'fs';
import * as path from 'path';
import { GraphQLJSON } from 'graphql-type-json';
import * as GraphQLUUID from 'graphql-type-uuid';
import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from 'graphql-tools';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { Export } from './types';

const env = process.env.NODE_ENV || 'development';
const port = process.env.PORT || 0;

const args = process.argv.slice(2);
const schemas = (args.length === 0 ? ['example'] : args).map(directory => {
    try {
        const fullPath = path.resolve(__dirname, '..', directory);
        return fs.readdirSync(fullPath).map(fileName => {
            try {
                return require(path.join(fullPath, fileName)).default as Export;
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
        type Query {
            hello: String
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
        hello: () => 'world!'
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