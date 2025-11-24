import { existsSync, writeFileSync } from "fs";
import winston from "winston";

const logFile = "app.log";
if (existsSync(logFile)) {
  writeFileSync(logFile, "");
}

let logImplementation: (...args: unknown[]) => void = (...args) => {
  console.log(...args);
};

try {
  const instance = winston.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
      new winston.transports.File({
        filename: "app.log",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
          })
        ),
      }),
    ],
  });

  logImplementation = instance.info.bind(instance);
} catch (error) {
  console.warn("Logger initialization failed, falling back to console logging", error);
}

export const logger = (...args: unknown[]) => {
  logImplementation(...args);
};
