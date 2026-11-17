#include <stdio.h>
#include <stdlib.h>

static int majorityElement(int* nums, int numsSize)
{
    int i, major, count = 0;
    for (i = 0; i < numsSize; i++) {
        if (count == 0) {
            major = nums[i];
            count++;
        } else if (major == nums[i]) {
            count++;
        } else {
            count--;
        }
    }
    return major;
}
