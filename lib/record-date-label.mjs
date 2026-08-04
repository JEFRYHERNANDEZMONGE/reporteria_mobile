const recordDateFormatter = new Intl.DateTimeFormat("es-CR", {
  day: "numeric",
  month: "long",
  timeZone: "America/Costa_Rica",
});

export function formatRecordDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return recordDateFormatter.format(date);
}
