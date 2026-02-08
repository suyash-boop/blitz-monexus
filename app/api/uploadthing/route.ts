import { createRouteHandler } from 'uploadthing/server';
import { ourFileRouter } from '@/lib/uploadthing';

const handler = createRouteHandler({
  router: ourFileRouter,
});

export { handler as GET, handler as POST };
