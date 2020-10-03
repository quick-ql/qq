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

let tsNodeEnabled = false;
const enableTsNode = () => {
    if (tsNodeEnabled) {
        return;
    }
    tsNodeEnabled = true;

    // Load ts-node
    register({
        transpileOnly: true,
        compilerOptions: {
            moduleResolution: 'node',
            target: 'es2020',
            noImplicitAny: false
        },
        ignore: []
    });

    log.debug('ts-node loaded')
}

const getSchemas = (directoryOrFile: string): string[] => {
    try {
        // Typescript or Javascript file
        if (directoryOrFile.endsWith('.ts') || directoryOrFile.endsWith('.js')) {
            return [directoryOrFile.startsWith('/') ? directoryOrFile : path.join(process.cwd(), directoryOrFile)];
        }

        // Directory
        const currentPath = directoryOrFile.startsWith('/') ? directoryOrFile : path.resolve(process.cwd(), directoryOrFile);
        return fs.readdirSync(currentPath, { withFileTypes: true }).map(({ isDirectory, name }) => {
            const fullPath = path.join(currentPath, name);
            if (isDirectory) {
                if (name.includes('node_modules')) {
                    return;
                }
                return getSchemas(fullPath);
            }
            return fullPath;
        }).flatMap(_ => _).filter(Boolean);
    } catch (error) {
        if (error.code === 'ENOENT') {
            fileLogger(error.path).debug('Path does not exist');
        }
    }
};

export const createServer = (schemaDirectories: string[] = []) => {
    const schemasLoaded: string[] = [];
    const schemasToLoad: string[] = [];
    const loadFile = (filePath: string) => {
        try {
            fileLogger(filePath).debug('Loading…');
            enableTsNode();
            const schema = require(filePath).default as Export;
            schemasLoaded.push(filePath);
            fileLogger(filePath).debug('Loaded');
            return schema;
        } catch (error) {
            fileLogger(filePath).debug('Failed loading', error);
            schemasToLoad.push(filePath);
        }
    };
    const schemas = schemaDirectories
        .map(getSchemas)
        // Flatten array to string[]
        .flatMap(_ => _)
        // Remove empty elements
        .filter(Boolean)
        // Load schema files
        .map((filePath, index, filePaths) => {
            log.debug(`Loading ${index + 1}/${filePaths.length}`);
            return loadFile(filePath);
        });

    if (schemasToLoad.length !== 0) {
        log.debug(`Loaded ${schemasLoaded.length}/${schemasToLoad.length + schemasLoaded.length} schemas.`);
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
        `] : schemas.map(_ => _?.schema)),
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