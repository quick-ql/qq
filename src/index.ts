import * as fs from 'fs';
import * as path from 'path';
import { GraphQLJSON } from 'graphql-type-json';
import * as GraphQLUUID from 'graphql-type-uuid';
import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from 'graphql-tools';
import { register } from 'ts-node';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { Export } from './types';

const env = process.env['NODE_ENV'] ?? 'development';
const port = process.env['PORT'] ?? 0;

const log = env === 'production' ? {
    ...console,
    debug() {}
} : console;

const fileLogger = (filePath: string) => {
    const logger = Object.fromEntries(Object.entries(log).map(([logName, logger]) => {
        const customLogger = (message: string, ...args: any[]) => logger(`${filePath.replace(process.cwd(), '.')}: ${message}`, ...args);
        return [logName, customLogger as typeof logger];
    })) as typeof log;
    return {
        ...(env === 'production' ? {
            ...logger,
            debug() {}
        } : logger)
    };
};

// Load ts-node
register({
    transpileOnly: true
});

const loadFile = (filePath: string) => {
    try {
        fileLogger(filePath).debug('Loading…');
        const schema = require(filePath).default as Export;
        schemasLoaded.push(filePath);
        fileLogger(filePath).debug('Loaded');
        return schema;
    } catch (error) {
        fileLogger(filePath).debug('Failed loading', error);
        schemasToLoad.push(filePath);
    }
}

const args = process.argv.slice(2);
const schemasLoaded: string[] = [];
const schemasToLoad: string[] = [];
const schemas = (args.length === 0 ? ['example'] : args).map(directoryOrFile => {
    try {
        // Typescript or Javascript file
        if (directoryOrFile.endsWith('.ts') || directoryOrFile.endsWith('.js')) {
            return directoryOrFile.startsWith('/') ? directoryOrFile : path.join(process.cwd(), directoryOrFile);
        }

        // Directory
        const fullPath = directoryOrFile.startsWith('/') ? directoryOrFile : path.resolve(process.cwd(), directoryOrFile);
        return fs.readdirSync(fullPath).map(fileName => {
            return path.join(fullPath, fileName);
        });
    } catch {}
}).flatMap(_ => _).filter(Boolean).map((filePath, index, filePaths) => {
    log.debug(`Loading ${index + 1}/${filePaths.length}`);
    return loadFile(filePath);
});

log.debug('Done!');

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
    if (schemasToLoad.length !== 0) {
        log.debug(`Loaded ${schemasLoaded.length}/${schemasToLoad.length + schemasLoaded.length} schemas.`)
    }
    log.info(`Graphql ready at ${url}`)
};

main().catch(error => log.error(env === 'production' ? error.message : error));