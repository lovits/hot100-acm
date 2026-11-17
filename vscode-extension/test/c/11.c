#include <stdio.h>
#include <stdlib.h>

static int maxArea(int* height, int heightSize)
{
    int min = 0, max = heightSize - 1;
    int area_max = 0;
    while (min < max) {
        int area = (max - min) * (height[min] < height[max] ? height[min] : height[max]);
        area_max = area > area_max ? area : area_max;
        if (height[min] < height[max]) {
            min++;
        } else {
            max--;
        }
    }
    return area_max;
}
