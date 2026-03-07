using ContextMaster.Core.Services;
using ContextMaster.Data;
using ContextMaster.Data.Implementations;
using Microsoft.UI.Xaml;

namespace ContextMaster.UI;

public partial class App : Application
{
    public static new App Current => (App)Application.Current;

    public IMenuManagerService MenuManagerService { get; private set; } = null!;
    public IOperationHistoryService OperationHistoryService { get; private set; } = null!;
    public IBackupService BackupService { get; private set; } = null!;

    public App()
    {
        InitializeComponent();
        UnhandledException += App_UnhandledException;

        try
        {
            var dbContext = new DatabaseContext();
            var registryService = new RegistryService();
            var historyService = new OperationHistoryService(dbContext);
            MenuManagerService = new MenuManagerService(registryService, historyService);
            OperationHistoryService = historyService;
            BackupService = new BackupService(dbContext, MenuManagerService);
        }
        catch (Exception ex)
        {
            WriteStartupError(ex);
            throw;
        }
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        try
        {
            m_window = new MainWindow();
            m_window.Activate();
        }
        catch (Exception ex)
        {
            WriteStartupError(ex);
            throw;
        }
    }

    private Window? m_window;

    private void App_UnhandledException(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        WriteStartupError(e.Exception);
        e.Handled = true;
        Environment.Exit(1);
    }

    private static void WriteStartupError(Exception ex)
    {
        string? path = null;
        try
        {
            var folder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "ContextMaster");
            Directory.CreateDirectory(folder);
            path = Path.Combine(folder, "startup_error.txt");
            File.WriteAllText(path, $"{DateTime.Now:O}\r\n{ex}\r\n\r\n{ex.StackTrace}");
        }
        catch { /* ignore */ }

        if (!string.IsNullOrEmpty(path) && File.Exists(path))
        {
            try { System.Diagnostics.Process.Start("notepad.exe", path); } catch { }
        }
    }
}
