import * as fs from 'fs';
import * as path from 'path';
import { GraphQLJSON } from 'graphql-type-json';
import * as GraphQLUUID from 'graphql-type-uuid';
import { ApolloServer } from 'apollo-server';
import { makeExecutableSchema } from 'graphql-tools';
import { register } from 'ts-node';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { Export } from './types';
import { log, debug, introspection, playground } from './utils';

const fileLogger = (filePath: string) => {
    const logger = Object.fromEntries(Object.entries(log).map(([logName, logger]) => {
        const customLogger = (message: string, ...args: any[]) => logger(`${filePath.replace(process.cwd(), '.')}: ${message}`, ...args);
        return [logName, customLogger as typeof logger];
    })) as typeof log;
    return {
        ...(debug ? logger : {
            ...logger,
            debug() {}
        })
    };
};

// Load ts-node
register({
    transpileOnly: true,
    compilerOptions: {
        moduleResolution: 'node',
        target: 'es2020'
    }
});

export const createServer = (args = ['node_modules/@quick-ql/examples']) => {
    const schemasLoaded: string[] = [];
    const schemasToLoad: string[] = [];
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
    };
    const schemas = (args.length === 0 ? ['node_modules/@quick-ql/examples'] : args).map(directoryOrFile => {
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
        } catch (error) {
            if (error.code === 'ENOENT') {
                fileLogger(error.path).debug('Path does not exist');
            }
        }
    }).flatMap(_ => _).filter(Boolean).map((filePath, index, filePaths) => {
        log.debug(`Loading ${index + 1}/${filePaths.length}`);
        return loadFile(filePath);
    });

    if (schemasToLoad.length !== 0) {
        log.debug(`Loaded ${schemasLoaded.length}/${schemasToLoad.length + schemasLoaded.length} schemas.`)
    }
    
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
    
    return new ApolloServer({
        playground,
        introspection,
        debug,
        schema
    });    
};