using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.Core.ViewModels;
using ContextMaster.UI.Controls;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ContextMaster.UI.Pages;

public sealed partial class MainPage : Page
{
    private readonly MainViewModel _viewModel;
    private readonly Dictionary<int, MenuItemCard> _cardMap = new();

    public MainPage()
    {
        InitializeComponent();
        _viewModel = new MainViewModel();
        LoadMenuItems();
    }

    private void LoadMenuItems()
    {
        ItemsPanel.Children.Clear();
        _cardMap.Clear();

        foreach (var item in _viewModel.MenuItems)
        {
            var card = CreateMenuItemCard(item);
            ItemsPanel.Children.Add(card);
            _cardMap[item.Id] = card;
        }
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

    private void OnItemToggled(MenuItemEntry item, bool isEnabled)
    {
        _viewModel.ToggleItem(item);
        UpdateDetailPanel(item);
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
        var searchText = SearchBox.Text.Trim();
        _viewModel.FilterItems(searchText);
        LoadMenuItems();
    }

    private void BatchEnableButton_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        var selectedItems = GetSelectedItems();
        _viewModel.BatchEnable(selectedItems);
        LoadMenuItems();
    }

    private void BatchDisableButton_Click(object sender, Microsoft.UI.Xaml.RoutedEventArgs e)
    {
        var selectedItems = GetSelectedItems();
        _viewModel.BatchDisable(selectedItems);
        LoadMenuItems();
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

    private void DetailPanel_CopyPathClicked(object? sender, EventArgs e)
    {
        // 处理复制路径操作
    }

    private void DetailPanel_OpenRegEditClicked(object? sender, EventArgs e)
    {
        // 处理打开注册表编辑器操作
    }
}
