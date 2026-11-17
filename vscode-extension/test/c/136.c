#include <stdio.h>
#include <stdlib.h>

static int singleNumber(int *nums, int numsSize)
{
    int i, s = 0;
    for (i = 0; i < numsSize; i++) {
        s ^= nums[i];
    }
    return s;
}
