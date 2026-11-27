using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Hot100Launcher
{
    [STAThread]
    private static void Main()
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string python = Path.Combine(root, @"runtime\python\pythonw.exe");
        string launcher = Path.Combine(root, "launch.pyw");
        try
        {
            if (!File.Exists(python) || !File.Exists(launcher))
                throw new FileNotFoundException("安装文件不完整，请重新运行 Hot100 安装程序。");
            Process.Start(new ProcessStartInfo(python, "\"" + launcher + "\"")
            {
                WorkingDirectory = root,
                UseShellExecute = false,
                CreateNoWindow = true
            });
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Hot100 ACM", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
