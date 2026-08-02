// Apollo Server setup for weave

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import typeDefs from './graphql/schema';
import resolvers from './graphql/resolvers';
import { subscriptionResolvers } from './graphql/subscriptions';

export function createApolloServer(httpServer: any) {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: {
      ...resolvers,
      Subscription: subscriptionResolvers
    }
  });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql'
  });

  const serverCleanup = useServer(
    {
      schema,
      onConnect: async (ctx) => {
        console.log('Client connected');
      },
      onDisconnect: async () => {
        console.log('Client disconnected');
      }
    },
    wsServer
  );

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            }
          };
        }
      }
    ]
  });

  return server;
}
