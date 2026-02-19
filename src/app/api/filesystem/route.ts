import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export async function GET() {
  try {
    const fsPath = path.join(process.cwd(), 'data', 'filesystems', 'base-filesystem.yaml');
    const content = fs.readFileSync(fsPath, 'utf-8');
    const parsed = yaml.load(content) as Record<string, unknown>;
    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Failed to load filesystem:', err);
    return NextResponse.json(
      { error: 'Failed to load filesystem' },
      { status: 500 }
    );
  }
}
