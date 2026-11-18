import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './src/config/env.js';
import router from './src/routes/index.js';
import { errorHandler, notFound } from './src/middlewares/errorHandler.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrls,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '1mb' }));

app.use('/api', router);
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[backend] API escuchando en http://localhost:${env.port}/api`);
});
