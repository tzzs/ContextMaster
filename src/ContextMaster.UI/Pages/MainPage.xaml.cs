using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Core.ViewModels;
using ContextMaster.UI.Controls;
using Microsoft.UI.Dispatching;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ContextMaster.UI.Pages;

public sealed partial class MainPage : Page
{
    private readonly MainViewModel _viewModel;
    private readonly Dictionary<int, MenuItemCard> _cardMap = new();
    private readonly Dictionary<MenuScene, string> _sceneTitles = new()
    {
        { MenuScene.Desktop, "桌面" },
        { MenuScene.File, "文件" },
        { MenuScene.Folder, "文件夹" },
        { MenuScene.Drive, "驱动器" },
        { MenuScene.DirectoryBackground, "目录背景" },
        { MenuScene.RecycleBin, "回收站" }
    };
    private readonly DispatcherQueue _dispatcherQueue;
    private bool _isUpdating = false;

    public MainPage()
    {
        InitializeComponent();
        _viewModel = new MainViewModel(App.Current.MenuManagerService);
        _dispatcherQueue = DispatcherQueue.GetForCurrentThread();

        // 监听场景变化以更新标题和加载菜单
        _viewModel.PropertyChanged += (sender, e) =>
        {
            if (e.PropertyName == nameof(MainViewModel.CurrentScene))
            {
                _dispatcherQueue.TryEnqueue(() => UpdateSceneTitle());
            }
            else if (e.PropertyName == nameof(MainViewModel.SearchText) ||
                     e.PropertyName == nameof(MainViewModel.FilterMode))
            {
                _dispatcherQueue.TryEnqueue(() => SafeLoadMenuItems());
            }
            else if (e.PropertyName == nameof(MainViewModel.StatusMessage))
            {
                _dispatcherQueue.TryEnqueue(() => UpdateStatusMessage());
            }
        };
    }

    private async void Page_Loaded(object sender, RoutedEventArgs e)
    {
        await _viewModel.LoadMenuItemsCommand.ExecuteAsync(null);
        SafeLoadMenuItems();
        UpdateSceneTitle();
    }

    private void UpdateSceneTitle()
    {
        if (_sceneTitles.TryGetValue(_viewModel.CurrentScene, out var title))
        {
            SceneTitle.Text = title;
        }
    }

    private void UpdateStatusMessage()
    {
        StatusText.Text = _viewModel.StatusMessage;
        StatusText.Visibility = string.IsNullOrWhiteSpace(_viewModel.StatusMessage)
            ? Visibility.Collapsed
            : Visibility.Visible;
    }

    private void SafeLoadMenuItems()
    {
        if (_isUpdating) return;

        _isUpdating = true;
        _dispatcherQueue.TryEnqueue(DispatcherQueuePriority.Low, () =>
        {
            try
            {
                LoadMenuItems();
            }
            finally
            {
                _isUpdating = false;
            }
        });
    }

    private void LoadMenuItems()
    {
        var filteredItems = _viewModel.GetFilteredMenuItems().ToList();
        var existingIds = _cardMap.Keys.ToHashSet();
        var newIds = filteredItems.Select(i => i.Id).ToHashSet();

        // 移除不再需要的卡片
        var idsToRemove = existingIds.Except(newIds).ToList();
        foreach (var id in idsToRemove)
        {
            if (_cardMap.TryGetValue(id, out var card))
            {
                ItemsPanel.Children.Remove(card);
                _cardMap.Remove(id);
            }
        }

        // 更新或添加卡片
        foreach (var item in filteredItems)
        {
            if (_cardMap.TryGetValue(item.Id, out var existingCard))
            {
                // 更新现有卡片的属性，而不是重新创建
                UpdateMenuItemCard(existingCard, item);
            }
            else
            {
                // 创建新卡片
                var card = CreateMenuItemCard(item);
                ItemsPanel.Children.Add(card);
                _cardMap[item.Id] = card;
            }
        }

        UpdateStatusMessage();
    }

    private void UpdateMenuItemCard(MenuItemCard card, MenuItemEntry item)
    {
        card.ItemName = item.Name;
        card.Source = item.Source;
        card.IsEnabled = item.IsEnabled;
        card.MenuScene = item.MenuScene;
        card.Type = item.Type;
        card.Tag = item;
    }

    private MenuItemCard CreateMenuItemCard(MenuItemEntry item)
    {
        var card = new MenuItemCard
        {
            ItemName = item.Name,
            Source = item.Source,
            IsEnabled = item.IsEnabled,
            MenuScene = item.MenuScene,
            Type = item.Type,
            IsSelected = false,
            Tag = item
        };

        card.Toggled += (s, e) => OnItemToggled(item, card.IsEnabled);
        card.IsSelected = false;

        return card;
    }

    private async void OnItemToggled(MenuItemEntry item, bool isEnabled)
    {
        await _viewModel.ToggleItemCommand.ExecuteAsync(item);
        UpdateDetailPanel(item);
        SafeLoadMenuItems();
    }

    private void UpdateDetailPanel(MenuItemEntry item)
    {
        if (item == null)
        {
            DetailPanel.Visibility = Microsoft.UI.Xaml.Visibility.Collapsed;
            return;
        }

        DetailPanel.Title = "条目详情";
        DetailPanel.ItemName = item.Name;
        DetailPanel.IsEnabled = item.IsEnabled;
        DetailPanel.MenuType = item.Type;
        DetailPanel.Source = item.Source;
        DetailPanel.Command = item.Command;
        DetailPanel.RegistryKey = item.RegistryKey;
        DetailPanel.MenuScene = item.MenuScene;
        DetailPanel.Visibility = Microsoft.UI.Xaml.Visibility.Visible;
    }

    private void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        _viewModel.SearchText = SearchBox.Text.Trim();
        SafeLoadMenuItems();
    }

    private async void BatchEnableButton_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        _viewModel.SelectedItems.Clear();
        foreach (var entry in GetSelectedItems())
            _viewModel.SelectedItems.Add(entry);
        await _viewModel.BatchEnableCommand.ExecuteAsync(null);
        SafeLoadMenuItems();
    }

    private async void BatchDisableButton_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        _viewModel.SelectedItems.Clear();
        foreach (var entry in GetSelectedItems())
            _viewModel.SelectedItems.Add(entry);
        await _viewModel.BatchDisableCommand.ExecuteAsync(null);
        SafeLoadMenuItems();
    }

    private List<MenuItemEntry> GetSelectedItems()
    {
        return _cardMap.Values
            .Where(card => card.IsSelected)
            .Select(card => card.Tag as MenuItemEntry)
            .OfType<MenuItemEntry>()
            .ToList();
    }

    private void DetailPanel_Toggled(object? sender, EventArgs e)
    {
        // 处理详情面板的切换操作
    }

    private void DetailPanel_EditClicked(object? sender, EventArgs e)
    {
        // 处理编辑操作
    }

    private void DetailPanel_DeleteClicked(object? sender, EventArgs e)
    {
        // 处理删除操作
    }

    private async void DetailPanel_CopyPathClicked(object? sender, EventArgs e)
    {
        var fullPath = System.IO.Path.Combine("HKEY_CLASSES_ROOT", DetailPanel.RegistryKey);
        await ContextMaster.UI.Helpers.PlatformHelper.CopyToClipboardAsync(fullPath);
    }

    private async void DetailPanel_OpenRegEditClicked(object? sender, EventArgs e)
    {
        var fullPath = System.IO.Path.Combine("HKEY_CLASSES_ROOT", DetailPanel.RegistryKey);
        await ContextMaster.UI.Helpers.PlatformHelper.OpenInRegistryEditorAsync(fullPath);
    }
}
