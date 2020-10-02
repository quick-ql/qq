import { v4 as uuid } from 'uuid';
import { Export } from '../src/types';

const books = new Map();

interface AddBookInput {
    name: string;
}

export default {
    schema: `
        type Book {
            id: UUID!
            name: String!
        }
        
        type Query {
            books: [Book]
        }
        
        input AddBookInput {
            name: String!
        }
        
        type Mutation {
            addBook(input: AddBookInput): Book
        }
    `,
    Query: {
        books() {
            return books.values();
        }
    },
    Mutation: {
        addBook(_: any, { input }: { input: AddBookInput }) {
            const { name } = input;
            const id = uuid();
            books.set(id, {
                id,
                name
            });
    
            return books.get(id);
        }
    }
} as Export;