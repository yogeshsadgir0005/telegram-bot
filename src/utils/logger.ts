type LogFields = Record<string, unknown>;

function line(level: string, msg: string, fields?: LogFields): string {
  const ts = new Date().toISOString();
  const extra = fields ? " " + JSON.stringify(fields) : "";
  return `[${ts}] ${level.padEnd(5)} ${msg}${extra}`;
}

export const logger = {
  info(msg: string, fields?: LogFields) {
    console.log(line("INFO", msg, fields));
  },
  warn(msg: string, fields?: LogFields) {
    console.warn(line("WARN", msg, fields));
  },
  error(msg: string, fields?: LogFields) {
    console.error(line("ERROR", msg, fields));
  },
};
