using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.UI.Helpers;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using System;

namespace ContextMaster.UI.Controls;

public sealed partial class DetailPanel : UserControl
{
    public static readonly DependencyProperty TitleProperty =
        DependencyProperty.Register(
            nameof(Title),
            typeof(string),
            typeof(DetailPanel),
            new PropertyMetadata("条目详情"));

    public static readonly DependencyProperty ItemNameProperty =
        DependencyProperty.Register(
            nameof(ItemName),
            typeof(string),
            typeof(DetailPanel),
            new PropertyMetadata(string.Empty));

    public static new readonly DependencyProperty IsEnabledProperty =
        DependencyProperty.Register(
            nameof(IsEnabled),
            typeof(bool),
            typeof(DetailPanel),
            new PropertyMetadata(true, OnIsEnabledChanged));

    public static readonly DependencyProperty MenuTypeProperty =
        DependencyProperty.Register(
            nameof(MenuType),
            typeof(MenuItemType),
            typeof(DetailPanel),
            new PropertyMetadata(MenuItemType.Custom));

    public static readonly DependencyProperty SourceProperty =
        DependencyProperty.Register(
            nameof(Source),
            typeof(string),
            typeof(DetailPanel),
            new PropertyMetadata(string.Empty));

    public static readonly DependencyProperty CommandProperty =
        DependencyProperty.Register(
            nameof(Command),
            typeof(string),
            typeof(DetailPanel),
            new PropertyMetadata(string.Empty));

    public static readonly DependencyProperty RegistryKeyProperty =
        DependencyProperty.Register(
            nameof(RegistryKey),
            typeof(string),
            typeof(DetailPanel),
            new PropertyMetadata(string.Empty));

    public static readonly DependencyProperty MenuSceneProperty =
        DependencyProperty.Register(
            nameof(MenuScene),
            typeof(MenuScene),
            typeof(DetailPanel),
            new PropertyMetadata(MenuScene.File));

    public string Title
    {
        get => (string)GetValue(TitleProperty);
        set => SetValue(TitleProperty, value);
    }

    public string ItemName
    {
        get => (string)GetValue(ItemNameProperty);
        set => SetValue(ItemNameProperty, value);
    }

    public new bool IsEnabled
    {
        get => (bool)GetValue(IsEnabledProperty);
        set => SetValue(IsEnabledProperty, value);
    }

    public MenuItemType MenuType
    {
        get => (MenuItemType)GetValue(MenuTypeProperty);
        set => SetValue(MenuTypeProperty, value);
    }

    public string Source
    {
        get => (string)GetValue(SourceProperty);
        set => SetValue(SourceProperty, value);
    }

    public string Command
    {
        get => (string)GetValue(CommandProperty);
        set => SetValue(CommandProperty, value);
    }

    public string RegistryKey
    {
        get => (string)GetValue(RegistryKeyProperty);
        set => SetValue(RegistryKeyProperty, value);
    }

    public MenuScene MenuScene
    {
        get => (MenuScene)GetValue(MenuSceneProperty);
        set => SetValue(MenuSceneProperty, value);
    }

    public event EventHandler? Toggled;
    public event EventHandler? EditClicked;
    public event EventHandler? DeleteClicked;
    public event EventHandler? CopyPathClicked;
    public event EventHandler? OpenRegEditClicked;

    public StatusTagType StatusTagType => IsEnabled ? StatusTagType.Enabled : StatusTagType.Disabled;
    public StatusTagType TypeTagType => MenuType == MenuItemType.System ? StatusTagType.System : StatusTagType.Custom;
    public string ToggleButtonText => IsEnabled ? "禁用" : "启用";
    public string SceneText => MenuScene.ToString();

    public Brush ToggleButtonBackground => IsEnabled
        ? (Brush)Application.Current.Resources["DangerBackgroundBrush"]
        : (Brush)Application.Current.Resources["SuccessBackgroundBrush"];

    public Brush ToggleButtonForeground => IsEnabled
        ? (Brush)Application.Current.Resources["DangerBrush"]
        : (Brush)Application.Current.Resources["SuccessBrush"];

    public DetailPanel()
    {
        InitializeComponent();
    }

    private static void OnIsEnabledChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is DetailPanel panel)
        {
            panel.OnToggled();
        }
    }

    private void ToggleButton_Click(object sender, RoutedEventArgs e)
    {
        IsEnabled = !IsEnabled;
    }

    private void EditButton_Click(object sender, RoutedEventArgs e)
    {
        EditClicked?.Invoke(this, EventArgs.Empty);
    }

    private void DeleteButton_Click(object sender, RoutedEventArgs e)
    {
        DeleteClicked?.Invoke(this, EventArgs.Empty);
    }

    private void CopyPathButton_Click(object sender, RoutedEventArgs e)
    {
        CopyPathClicked?.Invoke(this, EventArgs.Empty);
    }

    private void OpenRegEditButton_Click(object sender, RoutedEventArgs e)
    {
        OpenRegEditClicked?.Invoke(this, EventArgs.Empty);
    }

    private void OnToggled()
    {
        Toggled?.Invoke(this, EventArgs.Empty);
    }
}
