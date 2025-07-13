export function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-US', options);
}

export function getDateFromNodeId(nodeId: string): string | null {
  // Daily note IDs format: daily-YYYY-MM-DD
  const match = nodeId.match(/^daily-(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : null;
}

export function getDailyNoteId(date: string): string {
  return `daily-${date}`;
}