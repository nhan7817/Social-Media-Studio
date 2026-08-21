import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execPromise = util.promisify(exec);

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const platform = process.platform;

    if (platform === 'win32') {
      // PowerShell script to display native Windows FolderBrowserDialog on top of all windows
      const psCommand = `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Chọn thư mục lưu trữ video trên máy tính'; $f.ShowNewFolderButton = $true; $form = New-Object System.Windows.Forms.Form; $form.TopMost = $true; if ($f.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"`;

      const { stdout, stderr } = await execPromise(psCommand, {
        timeout: 120000,
        encoding: 'utf8',
      });

      const selectedPath = stdout.trim();

      if (!selectedPath) {
        return NextResponse.json({ cancelled: true, message: 'Người dùng đã hủy chọn thư mục.' });
      }

      const resolved = path.resolve(selectedPath);
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true });
      }

      return NextResponse.json({
        success: true,
        selectedPath: resolved,
      });
    } else if (platform === 'darwin') {
      // macOS AppleScript folder chooser
      const appleScript = `osascript -e 'POSIX path of (choose folder with prompt "Chọn thư mục lưu trữ video:")'`;
      const { stdout } = await execPromise(appleScript, { timeout: 120000 });
      const selectedPath = stdout.trim();

      if (!selectedPath) {
        return NextResponse.json({ cancelled: true });
      }

      return NextResponse.json({
        success: true,
        selectedPath: path.resolve(selectedPath),
      });
    } else {
      // Linux zenity / kdialog
      const zenityCommand = `zenity --file-selection --directory --title="Chọn thư mục lưu trữ video"`;
      try {
        const { stdout } = await execPromise(zenityCommand, { timeout: 120000 });
        const selectedPath = stdout.trim();
        if (selectedPath) {
          return NextResponse.json({ success: true, selectedPath: path.resolve(selectedPath) });
        }
      } catch {}
      return NextResponse.json({ cancelled: true });
    }
  } catch (error: any) {
    console.error('Folder dialog error:', error);
    return NextResponse.json({ error: error.message || 'Không thể mở hộp thoại chọn thư mục.' }, { status: 500 });
  }
}
