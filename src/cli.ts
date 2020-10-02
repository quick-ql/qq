#!/usr/bin/env node
import { main } from './index';
import { log, env, port } from './utils';

// Start server
main(process.argv.slice(2), port).then(({ url }) => {
    log.info(`Graphql ready at ${url}`);
}).catch(error => log.error(env === 'production' ? error.message : error));