using ContextMaster.Core.ViewModels;
using Microsoft.UI.Xaml.Controls;

namespace ContextMaster.UI.Pages;

public sealed partial class HistoryPage : Page
{
    private readonly HistoryViewModel _viewModel;

    public HistoryPage()
    {
        InitializeComponent();
        var app = (App)Microsoft.UI.Xaml.Application.Current;
        _viewModel = new HistoryViewModel(app.OperationHistoryService, app.MenuManagerService);
        _ = _viewModel.LoadRecordsCommand.ExecuteAsync(null);
        HistoryListView.ItemsSource = _viewModel.Records;
    }
}
