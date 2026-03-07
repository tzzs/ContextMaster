using ContextMaster.Core.Models.Entities;
using ContextMaster.Core.Models.Enums;
using ContextMaster.UI.Helpers;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using System;

namespace ContextMaster.UI.Controls;

public sealed partial class MenuItemCard : UserControl
{
    public static readonly DependencyProperty ItemNameProperty =
        DependencyProperty.Register(
            nameof(ItemName),
            typeof(string),
            typeof(MenuItemCard),
            new PropertyMetadata(string.Empty));

    public static readonly DependencyProperty SourceProperty =
        DependencyProperty.Register(
            nameof(Source),
            typeof(string),
            typeof(MenuItemCard),
            new PropertyMetadata(string.Empty));

    public static new readonly DependencyProperty IsEnabledProperty =
        DependencyProperty.Register(
            nameof(IsEnabled),
            typeof(bool),
            typeof(MenuItemCard),
            new PropertyMetadata(true, OnIsEnabledChanged));

    public static readonly DependencyProperty MenuSceneProperty =
        DependencyProperty.Register(
            nameof(MenuScene),
            typeof(MenuScene),
            typeof(MenuItemCard),
            new PropertyMetadata(MenuScene.File));

    public static readonly DependencyProperty TypeProperty =
        DependencyProperty.Register(
            nameof(Type),
            typeof(MenuItemType),
            typeof(MenuItemCard),
            new PropertyMetadata(MenuItemType.Custom));

    public static readonly DependencyProperty IsSelectedProperty =
        DependencyProperty.Register(
            nameof(IsSelected),
            typeof(bool),
            typeof(MenuItemCard),
            new PropertyMetadata(false, OnIsSelectedChanged));

    public string ItemName
    {
        get => (string)GetValue(ItemNameProperty);
        set => SetValue(ItemNameProperty, value);
    }

    public string Source
    {
        get => (string)GetValue(SourceProperty);
        set => SetValue(SourceProperty, value);
    }

    public new bool IsEnabled
    {
        get => (bool)GetValue(IsEnabledProperty);
        set => SetValue(IsEnabledProperty, value);
    }

    public MenuScene MenuScene
    {
        get => (MenuScene)GetValue(MenuSceneProperty);
        set => SetValue(MenuSceneProperty, value);
    }

    public MenuItemType Type
    {
        get => (MenuItemType)GetValue(TypeProperty);
        set => SetValue(TypeProperty, value);
    }

    public bool IsSelected
    {
        get => (bool)GetValue(IsSelectedProperty);
        set => SetValue(IsSelectedProperty, value);
    }

    public event EventHandler? Toggled;

    public StatusTagType TagType => Type == MenuItemType.System ? StatusTagType.System : StatusTagType.Custom;

    public string ButtonText => IsEnabled ? "禁用" : "启用";

    public Brush ButtonBackground => IsEnabled
        ? (Brush)Application.Current.Resources["DangerBackgroundBrush"]
        : (Brush)Application.Current.Resources["SuccessBackgroundBrush"];

    public Brush ButtonForeground => IsEnabled
        ? (Brush)Application.Current.Resources["DangerBrush"]
        : (Brush)Application.Current.Resources["SuccessBrush"];

    public string SceneText => MenuScene.ToString();

    public MenuItemCard()
    {
        InitializeComponent();
    }

    private static void OnIsEnabledChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is MenuItemCard card)
        {
            card.OnToggled();
        }
    }

    private static void OnIsSelectedChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is MenuItemCard card)
        {
            card.UpdateSelectedState();
        }
    }

    private void SelectCheckBox_Checked(object sender, RoutedEventArgs e)
    {
        IsSelected = true;
    }

    private void SelectCheckBox_Unchecked(object sender, RoutedEventArgs e)
    {
        IsSelected = false;
    }

    private void UpdateSelectedState()
    {
        SelectCheckBox.IsChecked = IsSelected;
    }

    private void ToggleButton_Click(object sender, RoutedEventArgs e)
    {
        IsEnabled = !IsEnabled;
    }

    private void ToggleSwitch_Toggled(object? sender, ToggledEventArgs e)
    {
        OnToggled();
    }

    private void OnToggled()
    {
        Toggled?.Invoke(this, EventArgs.Empty);
    }
}
