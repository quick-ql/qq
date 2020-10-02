import { Export } from '../src/types';

interface Movie {
    id: String;
}

const movies = new Map<string, Movie>();

export default {
    schema: `
        type Movie {
            id: Int!
            name: String!
        }

        type Query {
            movies: [Movie]
        }
    `,
    Query: {
        movies() {
            return movies.entries();
        }
    }
} as Export;
