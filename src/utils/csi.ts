interface CSIInput {
  battery: number;
  solarInput: number;
  load: number;
  relay: boolean;
}

export function calculateCSI({
  battery,
  solarInput,
  load,
  relay,
}: CSIInput) {

  const batteryScore =
    battery * 0.4;

  const solarScore =
    solarInput * 0.3;

  const loadScore =
    (100 - load) * 0.2;

  const stabilityScore =
    relay ? 10 : 4;

  const csi =
    batteryScore +
    solarScore +
    loadScore +
    stabilityScore;

  return Math.max(
    0,
    Math.min(100, Number(csi.toFixed(2)))
  );
}