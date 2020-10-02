export interface Query {
    [fieldName: string]: () => any
};

export interface Mutation {
    [fieldName: string]: (_: any, { input }: {
        input: {
            [key: string]: any;
        }
    }) => any;
}

export type Export = {
    schema: string;
    Query: Query;
    Mutation?: Mutation;
} | {
    schema: string;
    Query?: Query;
    Mutation: Mutation;
};
