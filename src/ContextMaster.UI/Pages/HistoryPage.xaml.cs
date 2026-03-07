using ContextMaster.Core.ViewModels;
using Microsoft.UI.Xaml.Controls;

namespace ContextMaster.UI.Pages;

public sealed partial class HistoryPage : Page
{
    private readonly HistoryViewModel _viewModel;

    public HistoryPage()
    {
        InitializeComponent();
        _viewModel = new HistoryViewModel();
        LoadHistoryRecords();
    }

    private void LoadHistoryRecords()
    {
        _viewModel.LoadRecords();
        HistoryListView.ItemsSource = _viewModel.OperationRecords;
    }
}
