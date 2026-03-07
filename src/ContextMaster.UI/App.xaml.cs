using Microsoft.UI.Xaml;

namespace ContextMaster.UI;

public partial class App : Application
{
    public static new App Current => (App)Application.Current;

    public App()
    {
        InitializeComponent();
        UnhandledException += App_UnhandledException;
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        m_window = new MainWindow();
        m_window.Activate();
    }

    private Window? m_window;

    private void App_UnhandledException(object sender, Microsoft.UI.Xaml.UnhandledExceptionEventArgs e)
    {
        e.Handled = true;
        // 这里可以添加错误处理逻辑，比如显示错误对话框
    }
}
