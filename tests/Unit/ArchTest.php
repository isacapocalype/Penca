<?php

arch()->preset()->php();

arch('native components extend the SuperNative component base')
    ->expect('App\NativeComponents')
    ->toExtend('Native\Mobile\Edge\NativeComponent');

arch('native components declare render')
    ->expect('App\NativeComponents')
    ->toHaveMethod('render');
