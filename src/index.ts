import { createServer } from './server';

export const main = async (schemasToLoad = ['example'], port: string | number = 0, callback?: () => void) => {
    const server = createServer(schemasToLoad);
    return server.listen(port, callback);
};
