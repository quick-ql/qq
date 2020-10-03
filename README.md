# QQ
Fast prototyping for graphql

## Installation
```bash
npm i -g github:quick-ql/qq
```

## Envs
```bash
PLAYGROUND=true
INTROSPECTION=true
DEBUG=true
PORT=8000
```

## Usage

```bash
$ PORT=9000 qq .
```

## Example file

`book.ts`

```ts
import { v4 as uuid } from 'uuid';
import { Export } from '@quick-ql/qq/dist/types';

interface Book {
    id: string;
    name: string;
}

const books = new Map<string, Book>();

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
```