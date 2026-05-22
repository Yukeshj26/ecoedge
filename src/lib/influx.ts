import { InfluxDB } from "@influxdata/influxdb-client";

const url = process.env.INFLUX_URL!;
const token = process.env.INFLUX_TOKEN!;
const org = process.env.INFLUX_ORG!;
const bucket = process.env.INFLUX_BUCKET!;

const client = new InfluxDB({
  url,
  token,
});

export const queryApi = client.getQueryApi(org);

export { bucket };

