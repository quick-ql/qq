import DataLoader from 'dataloader';

export const createLoader = (database: Map<string|number, any>) => new DataLoader(async (ids: any[]) => ids.map(id => database.get(id)));
export const env = process.env['NODE_ENV'] ?? 'development';
export const port = process.env['PORT'] ?? 0;
export const debug = Boolean(process.env['DEBUG'] ?? false);
export const introspection = Boolean(process.env['INTROSPECTION'] ?? true);
export const playground = Boolean(process.env['PLAYGROUND'] ?? true);
export const log = debug ? console : {
    ...console,
    debug() {}
};