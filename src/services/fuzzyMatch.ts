import { Player } from '../types';

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  return dp[m][n];
}

function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(str1.toLowerCase(), str2.toLowerCase()) / maxLen;
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function findBestMatch(searchText: string, availablePlayers: Player[], threshold: number = 0.6): Player | null {
  const normalizedSearch = normalize(searchText);
  const tokens = normalizedSearch.split(' ').filter(t => t.length > 2);
  if (tokens.length === 0) return null;

  let bestMatch: Player | null = null;
  let bestScore = 0;

  for (const player of availablePlayers) {
    const playerName = normalize(`${player.name} ${player.surname}`);
    const playerTeam = normalize(player.team);
    let score = similarity(normalizedSearch, playerName);
    
    for (const token of tokens) {
      if (playerName.includes(token)) score += 0.2;
      if (playerTeam.includes(token)) score += 0.1;
    }
    if (playerName.includes(normalizedSearch) || normalizedSearch.includes(playerName)) score += 0.3;

    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = player;
    }
  }
  return bestMatch;
}

export function extractPlayersFromText(text: string, availablePlayers: Player[]): { player: Player; confidence: number }[] {
  const lines = text.split(/[\n,;]+/).map(l => l.trim()).filter(l => l.length > 2);
  const found: { player: Player; confidence: number }[] = [];
  const foundIds = new Set<string>();

  for (const line of lines) {
    const match = findBestMatch(line, availablePlayers, 0.5);
    if (match && !foundIds.has(match.id)) {
      foundIds.add(match.id);
      found.push({ player: match, confidence: 0.7 });
    }
  }
  return found;
}
