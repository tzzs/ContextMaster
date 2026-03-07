using ContextMaster.Core.ViewModels;
using Microsoft.UI.Xaml.Controls;

namespace ContextMaster.UI.Pages;

public sealed partial class BackupPage : Page
{
    private readonly BackupViewModel _viewModel;

    public BackupPage()
    {
        InitializeComponent();
        _viewModel = new BackupViewModel();
        LoadBackups();
    }

    private void LoadBackups()
    {
        _viewModel.LoadBackups();
        BackupGridView.ItemsSource = _viewModel.BackupSnapshots;
    }
}
