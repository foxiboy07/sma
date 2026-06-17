import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

const pinoConfig = isDevelopment
  ? {
      level: process.env.LOG_LEVEL || 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    }
  : {
      level: process.env.LOG_LEVEL || 'info',
    };

export const logger = pino(pinoConfig);

export const createRequestLogger = () => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info(
        {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
          tenant_id: req.auth?.tenant_id,
        },
        `${req.method} ${req.path}`
      );
    });

    next();
  };
};
