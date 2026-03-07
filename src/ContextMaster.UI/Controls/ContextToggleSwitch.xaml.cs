using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Animation;
using System;

namespace ContextMaster.UI.Controls;

public sealed partial class ContextToggleSwitch : UserControl
{
    public static readonly DependencyProperty IsOnProperty =
        DependencyProperty.Register(
            nameof(IsOn),
            typeof(bool),
            typeof(ContextToggleSwitch),
            new PropertyMetadata(false, OnIsOnChanged));

    public static readonly DependencyProperty TrackBackgroundProperty =
        DependencyProperty.Register(
            nameof(TrackBackground),
            typeof(Brush),
            typeof(ContextToggleSwitch),
            new PropertyMetadata(null));

    public bool IsOn
    {
        get => (bool)GetValue(IsOnProperty);
        set => SetValue(IsOnProperty, value);
    }

    public Brush TrackBackground
    {
        get => (Brush)GetValue(TrackBackgroundProperty);
        set => SetValue(TrackBackgroundProperty, value);
    }

    public event EventHandler<ToggledEventArgs>? Toggled;

    private const double ThumbOffPosition = 0;
    private const double ThumbOnPosition = 23;

    public ContextToggleSwitch()
    {
        InitializeComponent();
        UpdateTrackBackground();
        UpdateThumbPosition(animate: false);
    }

    private static void OnIsOnChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is ContextToggleSwitch toggleSwitch)
        {
            toggleSwitch.UpdateVisuals();
        }
    }

    private void UpdateVisuals()
    {
        UpdateTrackBackground();
        UpdateThumbPosition(animate: true);
        RaiseToggledEvent();
    }

    private void UpdateTrackBackground()
    {
        if (TrackBackground != null)
        {
            return;
        }

        var resourceLoader = Application.Current.Resources;
        TrackBackground = IsOn
            ? (Brush)resourceLoader["AccentPrimaryBrush"]
            : (Brush)resourceLoader["DisabledTrackBrush"];
    }

    private void UpdateThumbPosition(bool animate = true)
    {
        var targetPosition = IsOn ? ThumbOnPosition : ThumbOffPosition;

        if (animate)
        {
            var animation = new DoubleAnimation
            {
                To = targetPosition,
                Duration = TimeSpan.FromMilliseconds(200),
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseInOut }
            };

            var storyboard = new Storyboard();
            storyboard.Children.Add(animation);
            Storyboard.SetTarget(animation, ThumbTransform);
            Storyboard.SetTargetProperty(animation, nameof(TranslateTransform.X));
            storyboard.Begin();
        }
        else
        {
            ThumbTransform.X = targetPosition;
        }
    }

    private void RootGrid_PointerPressed(object sender, PointerRoutedEventArgs e)
    {
        IsOn = !IsOn;
    }

    private void RaiseToggledEvent()
    {
        Toggled?.Invoke(this, new ToggledEventArgs { IsOn = IsOn });
    }
}

public class ToggledEventArgs : EventArgs
{
    public bool IsOn { get; set; }
}
