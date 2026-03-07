using ContextMaster.Core.ViewModels;
using Microsoft.UI.Xaml.Controls;

namespace ContextMaster.UI.Pages;

public sealed partial class BackupPage : Page
{
    private readonly BackupViewModel _viewModel;

    public BackupPage()
    {
        InitializeComponent();
        var app = (App)Microsoft.UI.Xaml.Application.Current;
        _viewModel = new BackupViewModel(app.BackupService);
        _ = _viewModel.LoadBackupsCommand.ExecuteAsync(null);
        BackupGridView.ItemsSource = _viewModel.Backups;
    }
}
