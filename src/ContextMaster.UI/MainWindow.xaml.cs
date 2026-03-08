using ContextMaster.UI.Pages;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;
using Windows.Graphics;
using WinRT.Interop;

namespace ContextMaster.UI;

public sealed partial class MainWindow : Window
{
    private const int WindowWidth = 1200;
    private const int WindowHeight = 720;

    public MainWindow()
    {
        InitializeComponent();
        InitializeWindowSize();
        NavigateToMainPage();
    }

    private void InitializeWindowSize()
    {
        IntPtr hWnd = WindowNative.GetWindowHandle(this);
        WindowId windowId = Win32Interop.GetWindowIdFromWindow(hWnd);
        AppWindow appWindow = AppWindow.GetFromWindowId(windowId);

        if (appWindow != null)
        {
            appWindow.Resize(new SizeInt32(WindowWidth, WindowHeight));
            appWindow.SetPresenter(AppWindowPresenterKind.Default);
        }
    }

    private void NavigateToMainPage()
    {
        MainContentFrame.Navigate(typeof(MainPage));
        NavView.SelectedItem = MenuItem_Main;
    }

    private void NavView_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (args.SelectedItem == sender.SettingsItem)
        {
            MainContentFrame.Navigate(typeof(SettingsPage));
            return;
        }

        if (args.SelectedItem is NavigationViewItem item)
        {
            string tag = (string)item.Tag;
            switch (tag)
            {
                case "main":
                    MainContentFrame.Navigate(typeof(MainPage));
                    break;
                case "history":
                    MainContentFrame.Navigate(typeof(HistoryPage));
                    break;
                case "backup":
                    MainContentFrame.Navigate(typeof(BackupPage));
                    break;
            }
        }
    }

    private void UndoButton_Click(object sender, RoutedEventArgs e)
    {
        // 触发撤销操作
        // 这里可以通过 ViewModel 或直接调用服务
    }
}
