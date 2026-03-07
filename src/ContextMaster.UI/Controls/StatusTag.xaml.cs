using ContextMaster.UI.Helpers;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;

namespace ContextMaster.UI.Controls;

public sealed partial class StatusTag : UserControl
{
    public static readonly DependencyProperty TagTypeProperty =
        DependencyProperty.Register(
            nameof(TagType),
            typeof(StatusTagType),
            typeof(StatusTag),
            new PropertyMetadata(StatusTagType.Custom, OnTagTypeChanged));

    public static readonly DependencyProperty TextProperty =
        DependencyProperty.Register(
            nameof(Text),
            typeof(string),
            typeof(StatusTag),
            new PropertyMetadata(string.Empty, OnTextChanged));

    public StatusTagType TagType
    {
        get => (StatusTagType)GetValue(TagTypeProperty);
        set => SetValue(TagTypeProperty, value);
    }

    public string Text
    {
        get => (string)GetValue(TextProperty);
        set => SetValue(TextProperty, value);
    }

    public StatusTag()
    {
        InitializeComponent();
        UpdateVisuals();
    }

    private static void OnTagTypeChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is StatusTag tag)
        {
            tag.UpdateVisuals();
        }
    }

    private static void OnTextChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is StatusTag tag)
        {
            tag.UpdateText();
        }
    }

    private void UpdateVisuals()
    {
        UpdateBackground();
        UpdateForeground();
        UpdateText();
    }

    private void UpdateBackground()
    {
        var resourceLoader = Application.Current.Resources;

        switch (TagType)
        {
            case StatusTagType.Enabled:
                RootBorder.Background = (Brush)resourceLoader["SuccessBackgroundBrush"];
                break;
            case StatusTagType.Disabled:
                RootBorder.Background = (Brush)resourceLoader["DangerBackgroundBrush"];
                break;
            case StatusTagType.System:
                RootBorder.Background = (Brush)resourceLoader["WarningBackgroundBrush"];
                break;
            case StatusTagType.Custom:
                RootBorder.Background = (Brush)resourceLoader["AccentBackgroundBrush"];
                break;
            case StatusTagType.Auto:
                RootBorder.Background = (Brush)resourceLoader["WarningBackgroundBrush"];
                break;
            case StatusTagType.Manual:
                RootBorder.Background = (Brush)resourceLoader["AccentBackgroundBrush"];
                break;
            default:
                RootBorder.Background = (Brush)resourceLoader["Surface2Brush"];
                break;
        }
    }

    private void UpdateForeground()
    {
        var resourceLoader = Application.Current.Resources;

        switch (TagType)
        {
            case StatusTagType.Enabled:
                TagText.Foreground = (Brush)resourceLoader["SuccessBrush"];
                break;
            case StatusTagType.Disabled:
                TagText.Foreground = (Brush)resourceLoader["DangerBrush"];
                break;
            case StatusTagType.System:
                TagText.Foreground = (Brush)resourceLoader["WarningBrush"];
                break;
            case StatusTagType.Custom:
                TagText.Foreground = (Brush)resourceLoader["AccentPrimaryBrush"];
                break;
            case StatusTagType.Auto:
                TagText.Foreground = (Brush)resourceLoader["WarningBrush"];
                break;
            case StatusTagType.Manual:
                TagText.Foreground = (Brush)resourceLoader["AccentPrimaryBrush"];
                break;
            default:
                TagText.Foreground = (Brush)resourceLoader["TextSecondaryBrush"];
                break;
        }
    }

    private void UpdateText()
    {
        if (!string.IsNullOrEmpty(Text))
        {
            TagText.Text = Text;
            return;
        }

        switch (TagType)
        {
            case StatusTagType.Enabled:
                TagText.Text = "启用";
                break;
            case StatusTagType.Disabled:
                TagText.Text = "禁用";
                break;
            case StatusTagType.System:
                TagText.Text = "系统";
                break;
            case StatusTagType.Custom:
                TagText.Text = "自定义";
                break;
            case StatusTagType.Auto:
                TagText.Text = "自动";
                break;
            case StatusTagType.Manual:
                TagText.Text = "手动";
                break;
            default:
                TagText.Text = "未知";
                break;
        }
    }
}
